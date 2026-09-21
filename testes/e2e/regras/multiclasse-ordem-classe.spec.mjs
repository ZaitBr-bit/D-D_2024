// ============================================================
// Issue #59 -- multiclasse Clérigo/Druida: escolha de Ordem Divina/Primal
// ao entrar como classe NOVA (o criador já pedia isso desde sempre; o
// motor de subida de nível nunca pedia), e abertura automática de
// "Preparar Magias" ao fechar o modal de conclusão, para classes
// conjuradoras PREPARADORAS (Clérigo/Druida/Paladino/Guardião) que
// entraram como classe nova nesta subida.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar,
  lerToastErro, personagemSalvo,
} from './helpers-regras.mjs';

const CARD_CLASSE = '#levelup-escolha-classe';
const PROXIMO = '#btn-step-proximo';
const ANTERIOR = '#btn-step-anterior';
const CONFIRMAR = '#btn-confirmar-levelup';
const STEP_ATIVO = '.levelup-step-ativo .levelup-step-label';

function radioClasse(page, nome) {
  return page.locator(`${CARD_CLASSE} input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

async function proximo(page) {
  await page.locator(PROXIMO).click();
  await assentar(page).catch(() => {});
}

function stepDaBarra(page, rotulo) {
  return page.locator('.levelup-progress .levelup-step', { hasText: rotulo });
}

async function irParaStep(page, rotulo) {
  await stepDaBarra(page, rotulo).click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO), `o clique na barra tem de abrir "${rotulo}"`)
    .toHaveText(rotulo);
}

/**
 * Clérigo nível 1 concede 3 truques (dados/classes/clerigo.json) -- o
 * step "Seleção de Magias" do wizard exige essa escolha antes de liberar
 * a Revisão. Clique real: abre o grid ("Selecionar"), marca os N
 * primeiros truques disponíveis, confirma.
 */
async function escolherTruquesQuaisquer(page, quantidade) {
  await page.locator('#btn-lvlup-truques').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const checks = page.locator('[data-grid-check]');
  for (let i = 0; i < quantidade; i++) {
    await checks.nth(i).click();
  }
  await page.locator('.modal-acoes button', { hasText: 'Confirmar Seleção' }).click();
  await assentar(page).catch(() => {});
}

// Mesma semente de multiclasse-proficiencias.spec.mjs: ATRIBUTOS_REGRAS
// (todos 13+) qualifica Clérigo (Sabedoria) sem nenhum pré-requisito no caminho.
const GUERREIRO_5 = {
  classe: 'Guerreiro', subclasse: '', nivel: 5, xp: 6500,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

test('Guerreiro 5 escolhe Clérigo: Ordem Divina é exigida na Revisão, chega ao personagem salvo, e Preparar Magias abre sozinho', async ({ context }) => {
  const id = 'regras-issue59-clerigo-ordem-divina';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await expect(page.locator(CARD_CLASSE)).toBeVisible();

  await radioClasse(page, 'Clérigo').click();
  await expect(page.locator(CARD_CLASSE), 'o contexto tem de ser reconstruído sobre o Clérigo')
    .toHaveAttribute('data-classe-ctx', 'Clérigo');
  await assentar(page).catch(() => {});

  // ORDEM IMPORTA: escolher a Ordem Divina PRIMEIRO. Taumaturgo soma +1
  // truque ganho (issue #59, correção de montarConjuracao) -- escolher os
  // truques antes da Ordem exigiria 3; depois dela, exige 4. Resolver na
  // ordem errada é o próprio oráculo de que a correção está funcionando
  // (achado desta sessão: escolher 3 truques e DEPOIS marcar Taumaturgo
  // faz a pendência de truques reaparecer, porque o requisito mudou).
  await irParaStep(page, 'Ordem Divina/Primal');
  const select = page.locator('#select-ordem-classe-nova');
  await expect(select, 'o seletor de Ordem Divina precisa estar na tela').toBeVisible();
  await expect(select, 'Taumaturgo é uma das duas opções do Clérigo').toContainText('Taumaturgo');
  await expect(select, 'Xamã é da Druida, não do Clérigo -- não pode aparecer aqui')
    .not.toContainText('Xamã');

  // A barreira real do produto: sem escolher, "Confirmar" recusa nomeando o step.
  await irParaStep(page, 'Revisão e Confirmação');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});
  expect(await lerToastErro(page),
    'sem escolher a Ordem Divina, a confirmação tem de ser recusada nomeando o passo')
    .toContain('Ordem Divina');
  await expect(page.locator(CONFIRMAR),
    'a recusa não pode fechar o modal -- senão a subida teria sido gravada sem a escolha').toBeVisible();

  // Escolhe Taumaturgo (clique real) -- ANTES de resolver os truques.
  await irParaStep(page, 'Ordem Divina/Primal');
  await select.selectOption('Taumaturgo');
  await assentar(page).catch(() => {});

  // Com Taumaturgo escolhido, o Clérigo ganha 4 truques (3 da tabela + 1
  // do Taumaturgo), não 3 -- a asserção que prova a correção do cálculo.
  await irParaStep(page, 'Seleção de Magias');
  await expect(page.locator('#lvlup-truques-resumo'), 'Taumaturgo soma +1 truque -- o total tem de ser 4, não 3')
    .toContainText('Selecione 4');
  await escolherTruquesQuaisquer(page, 4);

  await irParaStep(page, 'Revisão e Confirmação');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  await expect.poll(() => personagemSalvo(page).then((p) => p.escolhas_classe?.ordem_divina),
    { message: 'Taumaturgo, escolhido na tela, tem de ter chegado ao personagem salvo' })
    .toEqual(['Taumaturgo']);
  await expect.poll(() => personagemSalvo(page).then((p) => p.classes.map((c) => `${c.classe} ${c.nivel}`)),
    { message: 'o nível tem de ter entrado no Clérigo, com o Guerreiro intacto em 5' })
    .toEqual(['Guerreiro 5', 'Clérigo 1']);

  // ISSUE #59, "preparar magias": clicar OK no modal de conclusão abre
  // "Preparar Magias" sozinho, mirando a classe recém-entrada.
  await expect(page.locator('text=Subida de Nível Concluída!')).toBeVisible();
  await page.locator('.modal-container button', { hasText: 'OK' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-titulo'),
    'ao fechar a subida, "Preparar Magias" precisa abrir sozinho para a classe que acabou de entrar (Clérigo)')
    .toHaveText('Preparar Magias');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// Achado do relato de um usuário depois do primeiro lançamento desta
// correção: ela só cobria ENTRADA NOVA (multiclasse), mas o pedido real
// é mais amplo -- qualquer subida de nível de uma classe preparadora que
// ganhe capacidade de preparo nova precisa abrir "Preparar Magias",
// inclusive classe ÚNICA subindo dentro da mesma classe (o cenário mais
// comum de todos).
test('Clérigo classe única sobe de nível 1 para 2: Preparar Magias abre sozinho também', async ({ context }) => {
  const id = 'regras-issue59-clerigo-classe-unica-sobe-nivel';
  const CLERIGO_1 = {
    classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 1, xp: 300,
    especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Religião', 'Medicina'],
  };
  const { page, erros } = await abrirFicha(context, CLERIGO_1, id);

  expect(await abrirModalLevelUp(page), 'o assistente de nível não abriu').toBe(true);
  await expect(page.locator(STEP_ATIVO)).not.toHaveText('Classe do Nível');

  await irParaStep(page, 'Revisão e Confirmação');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  await expect.poll(() => personagemSalvo(page).then((p) => p.classes.map((c) => `${c.classe} ${c.nivel}`)),
    { message: 'o Clérigo tem de ter subido para nível 2' })
    .toEqual(['Clérigo 2']);

  await expect(page.locator('text=Subida de Nível Concluída!')).toBeVisible();
  await page.locator('.modal-container button', { hasText: 'OK' }).click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#modal-titulo'),
    'ao fechar a subida, "Preparar Magias" precisa abrir sozinho mesmo numa subida de nível comum (classe única, não multiclasse)')
    .toHaveText('Preparar Magias');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Guerreiro 5 escolhe Bárbaro: Preparar Magias NÃO abre sozinho -- o contraste (Bárbaro não conjura)', async ({ context }) => {
  const id = 'regras-issue59-barbaro-sem-preparar-magias';
  const { page, erros } = await abrirFicha(context, GUERREIRO_5, id);

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }),
    'o assistente de nível não abriu').toBe(true);
  await radioClasse(page, 'Bárbaro').click();
  await assentar(page).catch(() => {});

  await proximo(page); // escolha_classe -> ganhos_nivel
  await proximo(page); // ganhos_nivel -> revisao_confirmacao (Bárbaro nível 1 não pede nada mais)
  await expect(page.locator(STEP_ATIVO)).toHaveText('Revisão e Confirmação');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  await expect(page.locator('text=Subida de Nível Concluída!')).toBeVisible();
  await page.locator('.modal-container button', { hasText: 'OK' }).click();
  await assentar(page).catch(() => {});

  await expect(page.locator('#modal-overlay'),
    'Bárbaro não é classe conjuradora -- nenhum modal de Preparar Magias pode ter aberto sozinho')
    .toBeHidden();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
