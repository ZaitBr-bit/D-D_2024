// ============================================================
// As magias que a subclasse concede aparecem na TELA de subida de nível,
// e ficam gravadas na ficha.
//
// O motor de unidade (testes/regras/unidade/subclasses-magias.test.mjs) já
// confronta a concessão contra o livro nas 48 subclasses. O que só o
// navegador prova é o outro lado do conserto do Plano 2: reanimar a rota de
// DOMÍNIO (levelup.js, filtro de nome que passou a aceitar "Magias DO ...")
// faz o card "Magias de Domínio — Automáticas" (levelup-cards.js:77-90) sair
// do vazio. A rota irmã, "sempre preparada", NÃO alimenta card nenhum -- seu
// único consumidor em toda site/js/ é o Set de deduplicação de
// levelup-ui.js:1241-1245 -- então fechar a lacuna por ela teria deixado a
// tela idêntica.
//
// PHB 2024, Magias do Círculo da Lua (Classes.md:2355-2368): nível 5 concede
// *Invocar Animais*.
//
// LIMITE DECLARADO, medido no pré-voo do plano: este spec sobe do nível 4
// para o 5, e NÃO do 2 para o 3 (que é onde a subclasse é escolhida), porque
// levelup-flow.js:198 calcula magiasDominioNivel a partir de `char.subclasse`
// -- a subclasse JÁ SALVA. No nível 3 o campo ainda está vazio quando o
// contexto é montado, então o card fica vazio ali por uma limitação de
// reatividade que este plano não toca (mesma família da Conjuração do
// Cavaleiro Místico). Subir do 4 para o 5 é o menor cenário que exercita o
// que o Plano 2 de fato consertou.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo } from './helpers-regras.mjs';

const DRUIDA_LUA_NIVEL_4 = {
  classe: 'Druida', nivel: 4, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Círculo da Lua',
  pericias_proficientes: ['Natureza', 'Percepção'],
};

/** Clica em "Próximo" e espera o modal reagir. Devolve false se o botão sumiu. */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await assentar(page).catch(() => {});
  return true;
}

test('level-up: o card de magias de domínio mostra a magia que o Círculo da Lua concede no nível 5', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, DRUIDA_LUA_NIVEL_4, 'regras-lua-lvl5');
  expect(await abrirModalLevelUp(page)).toBe(true);

  // O card vive no primeiro passo (ganhos do nível). Se não estiver visível
  // de cara, avança um passo -- o fluxo do Druida no nível 5 não pede
  // subclasse (já escolhida) nem ASI.
  const card = page.locator('.levelup-card', { hasText: 'Magias de Domínio — Automáticas' });
  if (!await card.count()) await proximo(page);

  await expect(card, 'o card de magias de domínio deveria aparecer no nível 5 do Círculo da Lua').toBeVisible();
  await expect(card).toContainText('Invocar Animais');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('level-up: a magia concedida pelo Círculo da Lua fica gravada na ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, DRUIDA_LUA_NIVEL_4, 'regras-lua-grava');

  // Confirma pelo motor de subida, como subclasse-conjuradora-levelup.spec.mjs
  // faz: o que este teste afirma é o estado final gravado, não a navegação
  // (coberta pelo teste acima).
  await page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const levelup = await import(new URL('./js/levelup.js', location.href).href);
    const personagem = store.listarPersonagens()[0];
    await levelup.subirDeNivel(personagem, { ignorar_xp: true });
    store.salvarPersonagem(personagem);
  });

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel).toBe(5);
  const preparadas = (salvo.magias_preparadas || []).map((m) => m.nome);
  expect(preparadas, 'Invocar Animais deveria estar nas magias preparadas depois do nível 5')
    .toContain('Invocar Animais');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
