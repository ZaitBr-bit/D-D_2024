// ============================================================
// Quem conjura pela subclasse também tem CD e ataque de magia na ficha.
//
// Cavaleiro Místico e Trapaceiro Arcano conjuram por tabela própria
// (regras-conjuracao-subclasse.js). A seção de Magias já era montada para
// eles -- o portão dela aceita ehSubclasseConjuradora() --, mas as caixas
// "CD Magia" e "Atq. Magia" no topo perguntavam só `info.conjurador`, que
// é falso para Guerreiro e Ladino. Mesma família da issue #20: critério
// escrito como lista de casos, com um caso faltando.
//
// A conta em si é do motor conjuracao-subclasse-atributo.test.mjs. Aqui o
// alvo é a TELA, e em especial o valor EXIBIDO: um portão aberto com o
// cálculo velho mostraria "CD Magia 0", que é pior que não mostrar nada.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha } from './helpers-regras.mjs';

// Inteligência 16 (+3), nível 3 (proficiência +2): CD 13, ataque +5.
const ATRIBUTOS_INT = {
  forca: 10, destreza: 14, constituicao: 12,
  inteligencia: 16, sabedoria: 10, carisma: 10,
};

/** Texto da caixa de estatística cujo rótulo é exatamente `rotulo` */
function caixaStat(page, rotulo) {
  return page.locator('.stat-box').filter({ has: page.locator('.stat-label', { hasText: rotulo }) });
}

const CASOS = [
  { classe: 'Ladino',    subclasse: 'Trapaceiro Arcano', pericias: ['Furtividade', 'História'] },
  { classe: 'Guerreiro', subclasse: 'Cavaleiro Místico', pericias: ['Atletismo', 'História'] },
];

for (const caso of CASOS) {
  test(`ficha: ${caso.subclasse} nv3 mostra CD e ataque de magia`, async ({ context }) => {
    const { page } = await abrirFicha(context, {
      classe: caso.classe,
      nivel: 3,
      xp: 355000,
      subclasse: caso.subclasse,
      atributos: ATRIBUTOS_INT,
      pericias_proficientes: caso.pericias,
    });

    const cd = caixaStat(page, 'CD Magia');
    await expect(cd, 'a caixa CD Magia não foi montada').toHaveCount(1);
    await expect(cd.locator('.stat-value'),
      'CD errada — 8 + proficiência 2 + Inteligência 3 = 13').toHaveText('13');

    const atq = caixaStat(page, 'Atq. Magia');
    await expect(atq, 'a caixa Atq. Magia não foi montada').toHaveCount(1);
    await expect(atq.locator('.stat-value'),
      'ataque errado — proficiência 2 + Inteligência 3 = +5').toHaveText('+5');
  });
}

test('ficha: subclasse não conjuradora continua sem CD de magia', async ({ context }) => {
  // O contrapeso. Abrir o portão para toda a classe daria CD de magia a
  // qualquer Guerreiro -- e o valor exibido seria 0.
  const { page } = await abrirFicha(context, {
    classe: 'Guerreiro',
    nivel: 3,
    xp: 355000,
    subclasse: 'Campeão',
    atributos: ATRIBUTOS_INT,
    pericias_proficientes: ['Atletismo', 'História'],
  });

  await expect(caixaStat(page, 'CD Magia'),
    'Guerreiro Campeão não conjura e não pode ter CD de magia').toHaveCount(0);
});

test('ficha: Trapaceiro Arcano de nível 2 ainda não mostra CD', async ({ context }) => {
  // A conjuração da subclasse só começa no nível 3. Antes disso o
  // personagem nem tem subclasse escolhida.
  const { page } = await abrirFicha(context, {
    classe: 'Ladino',
    nivel: 2,
    xp: 355000,
    atributos: ATRIBUTOS_INT,
    pericias_proficientes: ['Furtividade', 'História'],
  });

  await expect(caixaStat(page, 'CD Magia'),
    'Ladino nível 2 não conjura').toHaveCount(0);
});
