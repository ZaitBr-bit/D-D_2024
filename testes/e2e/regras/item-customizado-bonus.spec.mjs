// ============================================================
// Item CUSTOMIZADO: bônus de CA e de ataque sem teto, e contados.
//
// Item customizado não é item do livro: é o espaço onde o mestre da mesa
// inventa o que quiser (a "Armadura Negra de Hades, Lendária, CA 20" do
// jogador). Os limites -5..+5 (CA) e -5..+10 (ataque) que a ficha impunha
// eram um palpite sobre item mágico do PHB aplicado a um campo livre --
// e barravam o item inteiro: com CA 20 o botão Salvar recusava e NADA era
// gravado, o que também explica o "o CA parece não estar contando".
//
// O criador de personagem (creator/passo-equipamento.js) NUNCA teve esses
// limites -- as duas telas respondiam diferente para o mesmo campo.
//
// Os testes medem as duas metades: a gravação (sem teto) e a CONTA (o bônus
// de um item equipado entra na CA da ficha).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

// Guerreiro sem armadura: CA = 10 + Destreza (14 → +2) = 12.
const CA_BASE = 12;
const BONUS_CA = 20;

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
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

test('item customizado: bônus de CA acima de +5 pode ser salvo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-item-custom-teto');
  await assentar(page).catch(() => {});

  await page.click('#btn-add-inv-custom');
  await page.waitForSelector('#ic-nome', { state: 'visible', timeout: 20_000 });

  await page.fill('#ic-nome', 'Armadura Negra de Hades');
  await page.fill('#ic-ca', String(BONUS_CA));
  await page.fill('#ic-atq', '12');
  await page.click('#btn-add-ic');

  // GUARDA CONTRA VACUIDADE: se o formulário recusou, o erro fica visível na
  // própria caixa -- e é isso que o jogador via.
  await expect(page.locator('#toast-container'),
    'o item precisa ter sido adicionado; se a validação barrou, nada foi gravado')
    .toContainText('adicionado');
  await assentar(page).catch(() => {});

  const salvo = await personagemSalvo(page);
  const item = (salvo?.inventario || []).find(i => i.nome === 'Armadura Negra de Hades');
  expect(item, 'o item customizado precisa estar no personagem salvo').toBeTruthy();
  expect(String(item.dados?.bonus_ca),
    'item customizado é campo livre da mesa: o bônus de CA digitado tem de ser gravado como está')
    .toBe(String(BONUS_CA));
  expect(String(item.dados?.bonus_ataque),
    'o mesmo vale para o bônus de ataque')
    .toBe('12');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado equipado: o bônus de CA entra na conta da ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{
      nome: 'Armadura Negra de Hades', tipo: 'customizado', quantidade: 1,
      equipado: true, descricao: 'Lendária',
      dados: { bonus_ca: String(BONUS_CA), dano: '', bonus_ataque: '12', peso: '' },
    }],
  }, 'regras-item-custom-ca-conta');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: `o item equipado dá +${BONUS_CA} de CA; a ficha precisa somar isso à CA base `
      + `de ${CA_BASE} (10 + Destreza)`,
  }).toBe(CA_BASE + BONUS_CA);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item customizado NÃO equipado: o bônus de CA não conta -- o contraste', async ({ context }) => {
  // Sem este contraste, "a CA subiu" passaria numa ficha que soma o bônus de
  // qualquer item guardado na mochila.
  const { page, erros } = await abrirFicha(context, {
    ...GUERREIRO,
    inventario: [{
      nome: 'Armadura Negra de Hades', tipo: 'customizado', quantidade: 1,
      equipado: false, descricao: 'Lendária',
      dados: { bonus_ca: String(BONUS_CA), dano: '', bonus_ataque: '12', peso: '' },
    }],
  }, 'regras-item-custom-ca-nao-equipado');
  await assentar(page).catch(() => {});

  await expect.poll(() => caExibida(page), {
    message: 'item na mochila não protege ninguém: sem equipar, o bônus não entra na CA',
  }).toBe(CA_BASE);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
