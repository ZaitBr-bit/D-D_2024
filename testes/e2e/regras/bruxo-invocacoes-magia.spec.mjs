// ============================================================
// Invocacoes Misticas que CONCEDEM magia (Bruxo).
//
// Relato: "armadura de sombras ... nao da a magia e bonus corretamente".
//
// Dois defeitos distintos sob o mesmo botao:
//
//  1. O handler de `[data-conjurar-pacto]` (sheet/habilidades.js) apenas
//     emitia um toast. Conjurar Armadura Arcana pela invocacao nao mexia
//     na CA -- exatamente o defeito que `conjurarSemEspaco` (magias.js) ja
//     corrigiu no caminho da Maestria de Magias do Mago, e que nunca foi
//     propagado para o do Bruxo. O que o livro dispensa e o ESPACO, e so
//     ele: o efeito mecanico continua valendo.
//
//  2. Tres nomes de MAPA_INVOCACOES_MAGIA estavam SEM ACENTO e nao existem
//     no catalogo. A busca por nome exato (`indiceMagiasCache.find`) ja
//     falhava, e o circulo caia no fallback 1: Levitacao (2o) e Respirar
//     na Agua (3o) apareciam como 1o circulo.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** Semeia um Bruxo com as invocacoes pedidas e abre a ficha na aba Magias. */
async function bruxoComInvocacoes(context, nomesInvocacoes, id) {
  const lado = await abrirFicha(context, {
    nome: 'Bruxo T', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
    nivel: 5, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 5, ordem: 0 }],
    schema_versao: 2,
    recursos: { bruxo: { invocacoes: nomesInvocacoes.map((nome) => ({ nome })) } },
  }, id);
  await assentar(lado.page).catch(() => {});
  await lado.page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });
  return lado.page;
}

test('Armadura de Sombras: conjurar pela invocacao aplica o efeito de CA, nao so um toast', async ({ context }) => {
  const page = await bruxoComInvocacoes(
    context, ['Pacto do Tomo', 'Armadura de Sombras'], 'bruxo-inv-1');

  const botao = page.locator('[data-conjurar-pacto="Armadura Arcana"]');
  await expect(botao, 'a magia da invocacao precisa ter botao de conjurar').toHaveCount(1);
  await botao.click();

  // Armadura Arcana serve em si ou em outra criatura, entao a rota completa
  // pergunta o alvo. E justamente esse modal que o caminho "so toast" nunca
  // abria -- se ele nao aparecer, o conserto nao pegou.
  const alvoSelf = page.locator('#alvo-self');
  await expect(alvoSelf, 'a conjuracao real pergunta o alvo antes de aplicar').toBeVisible({ timeout: 10_000 });
  await alvoSelf.click();
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);
  const efeito = (p.efeitos_magicos || []).find((e) => e.nome === 'Armadura Arcana');
  expect(efeito, `nenhum efeito gravado -- efeitos: ${JSON.stringify(p.efeitos_magicos || [])}`)
    .toBeTruthy();
  expect(efeito.tipo_efeito, 'Armadura Arcana define a CA BASE').toBe('base');
  expect(efeito.valor, 'CA base 13 + Destreza').toBe(13);
});

test('as magias de invocacao com acento resolvem no catalogo e mostram o circulo certo', async ({ context }) => {
  const page = await bruxoComInvocacoes(context, [
    'Pacto do Tomo',
    'Passo Ascendente',        // Levitacao, 2o circulo
    'Presente das Profundezas', // Respirar na Agua, 3o circulo
    'Mascara das Muitas Faces', // Disfarcar-se, 1o circulo
  ], 'bruxo-inv-2');

  for (const [magia, circulo] of [['Levitação', 2], ['Respirar na Água', 3], ['Disfarçar-se', 1]]) {
    const item = page.locator(`.magia-item[data-magia-nome="${magia}"]`);
    await expect(item, `"${magia}" precisa aparecer com o nome acentuado do catalogo`)
      .toHaveCount(1);
    await expect(item, `"${magia}" e do ${circulo}o circulo`)
      .toHaveAttribute('data-magia-circ', String(circulo));
  }
});

test('todo botao de conjurar do Pacto declara o circulo da magia', async ({ context }) => {
  // Pacto da Corrente emite o botao de "Convocar Familiar" sempre, sem
  // depender de escolha nenhuma -- e o que garante que este oraculo mede
  // um botao de verdade em vez de uma tela vazia (nascer verde por cima do
  // buraco foi o primeiro erro desta rodada de medicao).
  const page = await bruxoComInvocacoes(
    context, ['Pacto da Corrente', 'Armadura de Sombras'], 'bruxo-inv-3');

  const todos = page.locator('[data-conjurar-pacto]');
  expect(await todos.count(), 'a fixture precisa ter botoes de pacto para medir')
    .toBeGreaterThan(1);
  const semCirculo = await page.locator('[data-conjurar-pacto]:not([data-conjurar-pacto-circ])').count();
  expect(semCirculo, 'sem o circulo no botao a conjuracao nao tem como aplicar o efeito')
    .toBe(0);
});
