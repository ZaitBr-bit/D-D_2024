// ============================================================
// Estilo de Luta Adicional (Campeão nível 7), NA FICHA.
//
// PHB 2024, Classes.md:3904 -- "Você ganha outro talento de Estilo de Luta
// à sua escolha."
//
// O level-up já exige a escolha (subclasse-escolha-levelup.spec.mjs). O que
// não existia era a rota da FICHA: um personagem que já ESTÁ no nível 7 --
// importado, criado direto no nível, ou que subiu antes de o assistente
// passar a perguntar -- via o cartão "Passiva — Talento Adicional" só com o
// texto do livro. Como o jogador relatou: "não solicita e não deixa".
//
// O teste vai até o fim da regra, e não até o cartão: escolhe Defensivo e
// mede a CA. Um estilo que fica gravado e não faz nada seria a mesma coisa
// que não ter escolhido.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

// Guerreiro com Cota de Malha (CA 16, fixa): Defensivo soma +1 enquanto
// estiver de armadura -- 17.
const COTA_DE_MALHA = {
  nome: 'Cota de Malha', tipo: 'armadura', quantidade: 1, equipado: true,
  dados: { ca: '16', categoria: 'Pesada' },
};

const CAMPEAO_7 = {
  classe: 'Guerreiro', subclasse: 'Campeão', nivel: 7, xp: 23000,
  atributos: ATRIBUTOS_REGRAS, pericias_proficientes: ['Atletismo', 'História'],
  escolhas_classe: { estilo_luta: ['Duelismo'] },
  inventario: [COTA_DE_MALHA],
};

/** CA exibida no card da ficha. */
async function caExibida(page) {
  return page.evaluate(() => {
    const rotulo = [...document.querySelectorAll('.stat-label')]
      .find(el => el.textContent.trim() === 'CA');
    const valor = rotulo?.parentElement?.querySelector('.stat-value')?.textContent;
    return valor ? Number(valor.trim()) : null;
  });
}

/** Abre os `<details>` da ficha e devolve o texto -- reaberto a cada leitura. */
function textoDaFichaAberta(page) {
  return page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
    return document.body.innerText;
  });
}

test('ficha: o Campeão de nível 7 pode escolher o Estilo de Luta Adicional', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, CAMPEAO_7, 'regras-campeao-estilo-extra');
  await assentar(page).catch(() => {});
  await textoDaFichaAberta(page);

  const caAntes = await caExibida(page);
  expect(caAntes, 'Cota de Malha dá CA 16 fixa; é dela que a medida do Defensivo parte').toBe(16);

  // GUARDA CONTRA VACUIDADE: sem o botão não há rota, e é exatamente disso
  // que o relato tratava.
  const botao = page.locator('[data-escolher-estilo-luta-extra]').first();
  await expect(botao,
    'a característica do nível 7 do Campeão dá um Estilo de Luta à escolha -- a ficha precisa '
    + 'oferecer onde escolher, para quem já passou do nível 7')
    .toBeVisible();

  await botao.click();
  await page.waitForSelector('#estilo-extra-select', { state: 'visible', timeout: 20_000 });

  // O estilo que o personagem JÁ tem não pode ser oferecido de novo: o livro
  // dá OUTRO talento de Estilo de Luta.
  const opcoes = await page.locator('#estilo-extra-select option').allTextContents();
  expect(opcoes.join('|'),
    'Duelismo já é o estilo de classe deste Guerreiro; oferecê-lo de novo seria dar o mesmo '
    + 'talento duas vezes')
    .not.toContain('Duelismo');

  await page.selectOption('#estilo-extra-select', 'Defensivo');
  await page.click('#btn-salvar-estilo-extra');

  await expect(page.locator('#toast-container'),
    'a escolha precisa ter sido gravada antes de medir o efeito dela')
    .toContainText('Defensivo');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.escolhas_classe?.estilo_luta,
    'o estilo adicional entra AO LADO do estilo de classe, na mesma lista -- é de lá que os '
    + 'efeitos passivos leem')
    .toEqual(['Duelismo', 'Defensivo']);

  await expect.poll(() => caExibida(page), {
    message: 'Defensivo dá +1 de CA enquanto o personagem usa armadura; se a CA não subiu, o '
      + 'estilo foi gravado sem valer nada',
  }).toBe(17);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: o Campeão pode TROCAR o Estilo de Luta Adicional já escolhido', async ({ context }) => {
  // Sem isto, "escolher" viraria escolha de mão única: um clique errado
  // ficaria gravado para sempre, e o jogador voltaria a não ter rota.
  const { page, erros } = await abrirFicha(context, {
    ...CAMPEAO_7,
    escolhas_classe: { estilo_luta: ['Duelismo', 'Arquearia'] },
  }, 'regras-campeao-estilo-extra-troca');
  await assentar(page).catch(() => {});
  await textoDaFichaAberta(page);

  await expect.poll(() => textoDaFichaAberta(page), {
    message: 'a ficha precisa MOSTRAR qual é o estilo adicional atual',
  }).toContain('Arquearia');

  await page.locator('[data-escolher-estilo-luta-extra]').first().click();
  await page.waitForSelector('#estilo-extra-select', { state: 'visible', timeout: 20_000 });
  await page.selectOption('#estilo-extra-select', 'Defensivo');
  await page.click('#btn-salvar-estilo-extra');

  await expect(page.locator('#toast-container'), 'a troca precisa ter sido gravada')
    .toContainText('Defensivo');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  expect(salvo?.escolhas_classe?.estilo_luta,
    'trocar SUBSTITUI o estilo adicional -- o Campeão ganha um, não uma coleção')
    .toEqual(['Duelismo', 'Defensivo']);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: Guerreiro sem a subclasse Campeão não ganha a rota -- o contraste', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...CAMPEAO_7, subclasse: 'Mestre da Batalha',
  }, 'regras-campeao-estilo-extra-contraste');
  await assentar(page).catch(() => {});
  await textoDaFichaAberta(page);

  await expect(page.locator('[data-escolher-estilo-luta-extra]'),
    'o Estilo de Luta Adicional é característica do CAMPEÃO; nenhuma outra subclasse pode '
    + 'ganhar o botão de brinde')
    .toHaveCount(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
