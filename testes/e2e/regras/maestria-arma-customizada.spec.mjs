// ============================================================
// Issue #96 -- dois defeitos ligados na mesma área (arma customizada,
// issue #82):
// (a) a descrição de propriedade/maestria de uma arma customizada não
//     aparecia formatada, como a de uma arma de catálogo -- só o nome cru.
// (b) a badge "Maestria: X" aparecia incondicionalmente, mesmo sem o
//     personagem ter escolhido aquela maestria de verdade (a arma
//     customizada nunca entrava no modal "Definir Maestrias").
// Este spec clica de verdade nos dois fluxos: abrir o detalhe do item
// (a) e escolher a maestria no modal (b).
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';

const GUERREIRO = {
  classe: 'Guerreiro', nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  inventario: [{
    nome: 'Espada Ancestral do Zait', tipo: 'customizado', equipado: true,
    dados: {
      categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Acuidade, Leve',
      dano: '1d8 Cortante', maestria: 'Trespassar',
    },
  }],
};

test('item (b): a badge de maestria da arma customizada só aparece depois de escolhida de verdade no modal', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-issue96-badge-condicional');
  await assentar(page).catch(() => {});

  // Antes de escolher: a badge não pode aparecer -- issue #96, item (b).
  await expect(page.locator('text=Maestria: Trespassar'),
    'sem escolha nenhuma no modal, a badge não pode aparecer').toHaveCount(0);

  // Abre "Definir Maestrias" (clique real) e confirma que a arma
  // customizada ENTRA na lista de escolha (issue #82 já deu categoria
  // Marcial Corpo a Corpo a ela; Guerreiro tem proficiência).
  await clicarSeletorFicha(page, '[data-config-maestrias]', { esperar: '#maestria-lista' });
  await assentar(page).catch(() => {});
  const lista = page.locator('#maestria-lista');
  await expect(lista.locator('[data-maestria-nome="Espada Ancestral do Zait"]'),
    'a arma customizada com categoria precisa aparecer na lista de escolha')
    .toHaveCount(1);

  // Clique real: escolher e salvar.
  await lista.locator('[data-maestria-nome="Espada Ancestral do Zait"]').click();
  await page.locator('#btn-salvar-maestrias').click();
  await assentar(page).catch(() => {});

  // Agora sim -- escolhida de verdade, a badge aparece.
  await expect(page.locator('text=Maestria: Trespassar'),
    'depois de escolhida no modal, a badge precisa aparecer').toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('item (a): o detalhe da arma customizada mostra propriedade e maestria formatadas, como uma arma de catálogo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO, 'regras-issue96-detalhe-formatado');
  await assentar(page).catch(() => {});

  // Clique real no item pra abrir o modal de detalhe.
  await page.locator('.inv-item', { hasText: 'Espada Ancestral do Zait' })
    .locator('[data-info-inv-sheet]').click();
  await page.waitForSelector('#modal-overlay', { state: 'visible' });

  await expect(page.locator('.section-divider', { hasText: 'Propriedades' }),
    'a seção "Propriedades" precisa existir, com uma entrada por propriedade')
    .toBeVisible();
  await expect(page.locator('details summary', { hasText: 'Acuidade' }),
    'Acuidade precisa aparecer como entrada própria, com descrição do glossário')
    .toBeVisible();
  await expect(page.locator('.section-divider', { hasText: 'Maestria: Trespassar' }),
    'a maestria precisa aparecer com o nome e a descrição do glossário, não só o texto cru')
    .toBeVisible();

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
